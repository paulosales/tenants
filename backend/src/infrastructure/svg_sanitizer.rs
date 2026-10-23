use quick_xml::events::{BytesEnd, BytesStart, Event};
use quick_xml::reader::Reader;
use quick_xml::writer::Writer;
use std::collections::HashSet;
use std::io::Cursor;

use crate::domain::errors::{DomainError, DomainResult};

pub struct SvgSanitizer;

impl SvgSanitizer {
    /// Strict Allow-list of safe SVG element tags
    fn allowed_tags() -> HashSet<&'static str> {
        [
            "svg", "g", "rect", "circle", "ellipse", "line", "polyline",
            "polygon", "path", "text", "tspan", "defs", "use", "title", "desc"
        ]
        .iter()
        .cloned()
        .collect()
    }

    /// Dangerous attributes that must be unconditionally stripped
    fn is_dangerous_attr(name: &str, value: &str) -> bool {
        let name_lower = name.to_lowercase();
        let val_lower = value.to_lowercase();

        // Disallow any event handler (onload, onclick, onmouseover, etc.)
        if name_lower.starts_with("on") {
            return true;
        }

        // Disallow script/data URIs in href, xlink:href, src, etc.
        if (name_lower.ends_with("href") || name_lower == "src")
            && (val_lower.contains("javascript:") || val_lower.contains("data:") || val_lower.contains("vbscript:"))
        {
            return true;
        }

        // Disallow CSS expressions in style
        if name_lower == "style" && (val_lower.contains("expression") || val_lower.contains("url(")) {
            return true;
        }

        false
    }

    /// Parses and sanitizes untrusted SVG markup
    pub fn sanitize(raw_svg: &str) -> DomainResult<String> {
        // Reject raw scripts or external entity references immediately
        if raw_svg.contains("<!ENTITY") || raw_svg.contains("<!DOCTYPE") || raw_svg.contains("<script") {
            return Err(DomainError::InvalidSvgMarkup(
                "SVG contains prohibited DOCTYPE, ENTITY, or SCRIPT elements".into(),
            ));
        }

        let mut reader = Reader::from_str(raw_svg);
        reader.config_mut().trim_text(true);
        let mut writer = Writer::new(Cursor::new(Vec::new()));
        let mut buf = Vec::new();
        let allowed_tags = Self::allowed_tags();

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    if !allowed_tags.contains(tag_name.as_str()) {
                        return Err(DomainError::InvalidSvgMarkup(format!(
                            "Prohibited SVG tag detected: <{}>",
                            tag_name
                        )));
                    }

                    let mut safe_elem = BytesStart::new(tag_name.as_str());
                    for attr in e.attributes() {
                        let attr = attr.map_err(|e| DomainError::InvalidSvgMarkup(format!("Malformed attribute: {}", e)))?;
                        let attr_name = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                        let attr_val = String::from_utf8_lossy(&attr.value).to_string();

                        if !Self::is_dangerous_attr(&attr_name, &attr_val) {
                            safe_elem.push_attribute((attr_name.as_str(), attr_val.as_str()));
                        }
                    }
                    writer.write_event(Event::Start(safe_elem)).map_err(|e| DomainError::Internal(e.to_string()))?;
                }
                Ok(Event::Empty(ref e)) => {
                    let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    if !allowed_tags.contains(tag_name.as_str()) {
                        return Err(DomainError::InvalidSvgMarkup(format!(
                            "Prohibited SVG element detected: <{}>",
                            tag_name
                        )));
                    }

                    let mut safe_elem = BytesStart::new(tag_name.as_str());
                    for attr in e.attributes() {
                        let attr = attr.map_err(|e| DomainError::InvalidSvgMarkup(format!("Malformed attribute: {}", e)))?;
                        let attr_name = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                        let attr_val = String::from_utf8_lossy(&attr.value).to_string();

                        if !Self::is_dangerous_attr(&attr_name, &attr_val) {
                            safe_elem.push_attribute((attr_name.as_str(), attr_val.as_str()));
                        }
                    }
                    writer.write_event(Event::Empty(safe_elem)).map_err(|e| DomainError::Internal(e.to_string()))?;
                }
                Ok(Event::End(ref e)) => {
                    let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    if allowed_tags.contains(tag_name.as_str()) {
                        writer.write_event(Event::End(BytesEnd::new(tag_name.as_str()))).map_err(|e| DomainError::Internal(e.to_string()))?;
                    }
                }
                Ok(Event::Text(ref e)) => {
                    writer.write_event(Event::Text(e.clone())).map_err(|e| DomainError::Internal(e.to_string()))?;
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(DomainError::InvalidSvgMarkup(format!("XML parser error: {}", e))),
                _ => {}
            }
            buf.clear();
        }

        let result = writer.into_inner().into_inner();
        let sanitized = String::from_utf8(result).map_err(|e| DomainError::Internal(e.to_string()))?;
        Ok(sanitized)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_svg_passes_sanitization() {
        let valid_svg = r##"<svg viewBox="0 0 1000 600"><rect x="10" y="10" width="80" height="140" fill="#3b82f6" /><text x="20" y="30">Spot 1</text></svg>"##;
        let result = SvgSanitizer::sanitize(valid_svg);
        assert!(result.is_ok());
        let sanitized = result.unwrap();
        assert!(sanitized.contains("rect"));
        assert!(sanitized.contains("Spot 1"));
    }

    #[test]
    fn test_rejects_script_tags() {
        let malicious_svg = r#"<svg><script>alert('XSS')</script><rect x="10" y="10" width="80" height="140" /></svg>"#;
        let result = SvgSanitizer::sanitize(malicious_svg);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DomainError::InvalidSvgMarkup(_)));
    }

    #[test]
    fn test_rejects_xml_entity_expansion_xxe() {
        let xxe_svg = r#"<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg><text>&xxe;</text></svg>"#;
        let result = SvgSanitizer::sanitize(xxe_svg);
        assert!(result.is_err());
    }

    #[test]
    fn test_strips_onload_and_event_handlers() {
        let onload_svg = r#"<svg><rect x="10" y="10" width="80" height="140" onload="alert(1)" onclick="steal()" /></svg>"#;
        let result = SvgSanitizer::sanitize(onload_svg);
        assert!(result.is_ok());
        let sanitized = result.unwrap();
        assert!(!sanitized.contains("onload"));
        assert!(!sanitized.contains("onclick"));
        assert!(!sanitized.contains("steal"));
    }

    #[test]
    fn test_strips_javascript_href() {
        let js_svg = r#"<svg><a href="javascript:alert(1)"><rect x="10" y="10" width="80" height="140" /></a></svg>"#;
        // <a> is not in allowed tags, so it rejects prohibited tag
        let result = SvgSanitizer::sanitize(js_svg);
        assert!(result.is_err());
    }
}

