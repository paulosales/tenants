use quick_xml::events::{BytesEnd, BytesStart, Event};
use quick_xml::reader::Reader;
use quick_xml::writer::Writer;
use std::collections::HashSet;
use std::io::Cursor;

use crate::domain::{
    errors::{DomainError, DomainResult},
    ports::SvgSanitizerPort,
};

pub struct SvgSanitizer;

/// Infrastructure adapter implementing the domain `SvgSanitizerPort`.
#[derive(Debug, Default, Clone)]
pub struct DefaultSvgSanitizer;

impl SvgSanitizerPort for DefaultSvgSanitizer {
    fn sanitize(&self, raw_svg: &str) -> DomainResult<String> {
        SvgSanitizer::sanitize(raw_svg)
    }
}

const MAX_SVG_BYTES: usize = 512 * 1024;
const MAX_SVG_DEPTH: usize = 32;

impl SvgSanitizer {
    /// Copies safe attributes from an XML element while stripping XSS/SSRF vectors.
    fn build_safe_element<'a>(
        e: &BytesStart<'_>,
        tag_name: &'a str,
    ) -> DomainResult<BytesStart<'a>> {
        let mut safe_elem = BytesStart::new(tag_name);
        for attr in e.attributes() {
            let attr = attr.map_err(|err| {
                DomainError::InvalidSvgMarkup(format!("Malformed attribute: {}", err))
            })?;
            let attr_name = String::from_utf8_lossy(attr.key.as_ref()).to_string();
            let attr_val = attr
                .unescape_value()
                .map_err(|err| {
                    DomainError::InvalidSvgMarkup(format!("Malformed attribute entity: {}", err))
                })?
                .into_owned();

            if !Self::is_dangerous_attr(&attr_name, &attr_val) {
                safe_elem.push_attribute((attr_name.as_str(), attr_val.as_str()));
            }
        }
        Ok(safe_elem)
    }

    /// Strict Allow-list of safe SVG element tags
    fn allowed_tags() -> HashSet<&'static str> {
        [
            "svg", "g", "rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "text",
            "tspan", "defs", "use", "title", "desc",
        ]
        .iter()
        .cloned()
        .collect()
    }

    /// Dangerous attributes that must be unconditionally stripped
    fn is_dangerous_attr(name: &str, value: &str) -> bool {
        let name_lower = name.trim().to_ascii_lowercase();
        let val_trimmed = value.trim();
        let val_lower = val_trimmed.to_ascii_lowercase();
        let val_compact: String = val_lower
            .chars()
            .filter(|c| !c.is_whitespace() && !c.is_control())
            .collect();

        // Disallow any event handler (onload, onclick, onmouseover, etc.)
        if name_lower.starts_with("on") {
            return true;
        }

        // Disallow script/data/external URIs in linking & resource attributes
        if matches!(
            name_lower.as_str(),
            "href"
                | "xlink:href"
                | "src"
                | "srcdoc"
                | "action"
                | "formaction"
                | "background"
                | "poster"
        ) || name_lower.ends_with("href")
        {
            if val_compact.contains("javascript:")
                || val_compact.contains("data:")
                || val_compact.contains("vbscript:")
                || !val_trimmed.starts_with('#')
            {
                return true;
            }
        }

        // Disallow CSS expressions, external url(), and @import in style attributes
        if name_lower == "style"
            && (val_compact.contains("expression")
                || val_compact.contains("url(")
                || val_compact.contains("@import")
                || val_compact.contains("behavior")
                || val_compact.contains("-moz-binding"))
        {
            return true;
        }

        false
    }

    /// Parses and sanitizes untrusted SVG markup
    pub fn sanitize(raw_svg: &str) -> DomainResult<String> {
        if raw_svg.len() > MAX_SVG_BYTES {
            return Err(DomainError::InvalidSvgMarkup(
                "SVG payload exceeds maximum 512 KB limit".into(),
            ));
        }

        // Case-insensitive fast reject for scripts or external entity / doctype declarations
        let lower = raw_svg.to_ascii_lowercase();
        if lower.contains("<!entity") || lower.contains("<!doctype") || lower.contains("<script") {
            return Err(DomainError::InvalidSvgMarkup(
                "SVG contains prohibited DOCTYPE, ENTITY, or SCRIPT elements".into(),
            ));
        }

        let mut reader = Reader::from_str(raw_svg);
        reader.config_mut().trim_text(true);
        let mut writer = Writer::new(Cursor::new(Vec::new()));
        let mut buf = Vec::new();
        let allowed_tags = Self::allowed_tags();
        let mut depth: usize = 0;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    depth += 1;
                    if depth > MAX_SVG_DEPTH {
                        return Err(DomainError::InvalidSvgMarkup(
                            "SVG element nesting depth exceeds maximum allowed limit".into(),
                        ));
                    }
                    let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    if !allowed_tags.contains(tag_name.as_str()) {
                        return Err(DomainError::InvalidSvgMarkup(format!(
                            "Prohibited SVG tag detected: <{}>",
                            tag_name
                        )));
                    }

                    let safe_elem = Self::build_safe_element(e, &tag_name)?;
                    writer
                        .write_event(Event::Start(safe_elem))
                        .map_err(|e| DomainError::Internal(e.to_string()))?;
                }
                Ok(Event::Empty(ref e)) => {
                    if depth + 1 > MAX_SVG_DEPTH {
                        return Err(DomainError::InvalidSvgMarkup(
                            "SVG element nesting depth exceeds maximum allowed limit".into(),
                        ));
                    }
                    let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    if !allowed_tags.contains(tag_name.as_str()) {
                        return Err(DomainError::InvalidSvgMarkup(format!(
                            "Prohibited SVG element detected: <{}>",
                            tag_name
                        )));
                    }

                    let safe_elem = Self::build_safe_element(e, &tag_name)?;
                    writer
                        .write_event(Event::Empty(safe_elem))
                        .map_err(|e| DomainError::Internal(e.to_string()))?;
                }
                Ok(Event::End(ref e)) => {
                    depth = depth.saturating_sub(1);
                    let tag_name = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    if allowed_tags.contains(tag_name.as_str()) {
                        writer
                            .write_event(Event::End(BytesEnd::new(tag_name.as_str())))
                            .map_err(|e| DomainError::Internal(e.to_string()))?;
                    }
                }
                Ok(Event::Text(ref e)) => {
                    writer
                        .write_event(Event::Text(e.clone()))
                        .map_err(|e| DomainError::Internal(e.to_string()))?;
                }
                Ok(Event::DocType(_)) | Ok(Event::PI(_)) => {
                    return Err(DomainError::InvalidSvgMarkup(
                        "Prohibited XML processing instruction or DOCTYPE detected".into(),
                    ));
                }
                Ok(Event::Eof) => break,
                Err(e) => {
                    return Err(DomainError::InvalidSvgMarkup(format!(
                        "XML parser error: {}",
                        e
                    )))
                }
                _ => {}
            }
            buf.clear();
        }

        let result = writer.into_inner().into_inner();
        let sanitized =
            String::from_utf8(result).map_err(|e| DomainError::Internal(e.to_string()))?;
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
        assert!(matches!(
            result.unwrap_err(),
            DomainError::InvalidSvgMarkup(_)
        ));
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

    #[test]
    fn test_rejects_uppercase_script_and_strips_external_use_href() {
        let upper_script = r#"<svg><SCRIPT>alert(1)</SCRIPT></svg>"#;
        assert!(SvgSanitizer::sanitize(upper_script).is_err());

        let external_use = r#"<svg><use href="https://evil.example/sprite.svg#x" /></svg>"#;
        let sanitized = SvgSanitizer::sanitize(external_use).unwrap();
        assert!(!sanitized.contains("https://evil.example"));

        let entity_obfuscated = r#"<svg><use href="&#106;avascript:alert(1)" /></svg>"#;
        let sanitized_entity = SvgSanitizer::sanitize(entity_obfuscated).unwrap();
        assert!(!sanitized_entity.contains("javascript"));
        assert!(!sanitized_entity.contains("href="));
    }
}
