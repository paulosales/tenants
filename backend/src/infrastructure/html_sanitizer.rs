use crate::domain::{
    errors::{DomainError, DomainResult},
    ports::HtmlSanitizerPort,
};

const MAX_HTML_BYTES: usize = 32 * 1024;

#[derive(Debug, Default, Clone)]
pub struct DefaultHtmlSanitizer;

impl HtmlSanitizerPort for DefaultHtmlSanitizer {
    fn sanitize(&self, raw_html: &str) -> DomainResult<String> {
        HtmlSanitizer::sanitize(raw_html)
    }
}

pub struct HtmlSanitizer;

impl HtmlSanitizer {
    fn is_allowed_tag(tag: &str) -> bool {
        matches!(
            tag,
            "p" | "br"
                | "strong"
                | "b"
                | "em"
                | "i"
                | "u"
                | "ul"
                | "ol"
                | "li"
                | "h2"
                | "h3"
                | "h4"
                | "blockquote"
                | "a"
        )
    }

    fn is_void_tag(tag: &str) -> bool {
        tag == "br"
    }

    fn is_drop_content_tag(tag: &str) -> bool {
        matches!(tag, "script" | "style" | "iframe" | "object" | "svg")
    }

    fn escape_text(raw: &str) -> String {
        let mut out = String::with_capacity(raw.len());
        for ch in raw.chars() {
            match ch {
                '<' => out.push_str("&lt;"),
                '>' => out.push_str("&gt;"),
                _ => out.push(ch),
            }
        }
        out
    }

    fn extract_safe_href(attrs_raw: &str) -> Option<String> {
        let lower = attrs_raw.to_ascii_lowercase();
        let idx = lower.find("href")?;
        let after_key = attrs_raw[idx + 4..].trim_start();
        let after_eq = after_key.strip_prefix('=')?.trim_start();
        let raw_val = if let Some(rest) = after_eq.strip_prefix('"') {
            rest.split('"').next()?
        } else if let Some(rest) = after_eq.strip_prefix('\'') {
            rest.split('\'').next()?
        } else {
            after_eq.split_whitespace().next()?
        };

        let decoded = raw_val
            .replace("&amp;", "&")
            .replace("&#x3a;", ":")
            .replace("&#58;", ":");
        let trimmed = decoded.trim();
        let compact_lower: String = trimmed
            .to_ascii_lowercase()
            .chars()
            .filter(|c| !c.is_whitespace() && !c.is_control())
            .collect();

        if compact_lower.starts_with("https://") || compact_lower.starts_with("http://") {
            let escaped = trimmed
                .replace('&', "&amp;")
                .replace('"', "&quot;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");
            Some(escaped)
        } else {
            None
        }
    }

    /// Sanitizes HTML rich-text descriptions using a strict allow-list of formatting tags (OWASP XSS).
    pub fn sanitize(raw_html: &str) -> DomainResult<String> {
        if raw_html.len() > MAX_HTML_BYTES {
            return Err(DomainError::ValidationError(
                "Property description exceeds maximum 32 KB limit".into(),
            ));
        }

        let mut output = String::with_capacity(raw_html.len());
        let mut rest = raw_html;
        let mut skipping_tag: Option<String> = None;

        while !rest.is_empty() {
            if let Some(lt_idx) = rest.find('<') {
                let text_chunk = &rest[..lt_idx];
                if skipping_tag.is_none() && !text_chunk.is_empty() {
                    output.push_str(&Self::escape_text(text_chunk));
                }

                let after_lt = &rest[lt_idx + 1..];
                if let Some(gt_idx) = after_lt.find('>') {
                    let raw_tag = after_lt[..gt_idx].trim();
                    rest = &after_lt[gt_idx + 1..];

                    if raw_tag.is_empty()
                        || raw_tag.starts_with("!--")
                        || raw_tag.starts_with('!')
                        || raw_tag.starts_with('?')
                    {
                        continue;
                    }

                    let is_closing = raw_tag.starts_with('/');
                    let body = if is_closing {
                        raw_tag[1..].trim()
                    } else {
                        raw_tag.trim_end_matches('/').trim()
                    };
                    let tag_name = body
                        .split_whitespace()
                        .next()
                        .unwrap_or("")
                        .to_ascii_lowercase();

                    if tag_name.is_empty() {
                        continue;
                    }

                    if let Some(ref active_drop) = skipping_tag {
                        if is_closing && &tag_name == active_drop {
                            skipping_tag = None;
                        }
                        continue;
                    }

                    if !is_closing
                        && Self::is_drop_content_tag(&tag_name)
                        && !raw_tag.ends_with('/')
                    {
                        skipping_tag = Some(tag_name);
                        continue;
                    }

                    if !Self::is_allowed_tag(&tag_name) {
                        continue;
                    }

                    if is_closing {
                        if !Self::is_void_tag(&tag_name) {
                            output.push_str("</");
                            output.push_str(&tag_name);
                            output.push('>');
                        }
                    } else if tag_name == "a" {
                        let attr_part = body[tag_name.len()..].trim();
                        if let Some(safe_href) = Self::extract_safe_href(attr_part) {
                            output.push_str("<a href=\"");
                            output.push_str(&safe_href);
                            output.push_str("\" rel=\"noopener noreferrer\" target=\"_blank\">");
                        } else {
                            output.push_str("<a>");
                        }
                    } else if Self::is_void_tag(&tag_name) {
                        output.push_str("<br />");
                    } else {
                        output.push('<');
                        output.push_str(&tag_name);
                        output.push('>');
                    }
                } else {
                    if skipping_tag.is_none() {
                        output.push_str(&Self::escape_text(rest));
                    }
                    break;
                }
            } else {
                if skipping_tag.is_none() {
                    output.push_str(&Self::escape_text(rest));
                }
                break;
            }
        }

        Ok(output.trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allows_safe_formatting_and_escapes_scripts() {
        let dirty = r#"<p onclick="alert(1)">Hello <strong>World</strong>!</p><script>stealCookies()</script><ul><li>Quiet</li></ul>"#;
        let clean = HtmlSanitizer::sanitize(dirty).unwrap();
        assert_eq!(
            clean,
            "<p>Hello <strong>World</strong>!</p><ul><li>Quiet</li></ul>"
        );
        assert!(!clean.contains("script"));
        assert!(!clean.contains("onclick"));
        assert!(!clean.contains("stealCookies"));
    }

    #[test]
    fn test_filters_unsafe_href_and_preserves_https_links() {
        let js_link = r#"<p><a href="javascript:alert(1)" onmouseover="x()">Click</a> and <a href="https://example.com/floorplan">Safe</a></p>"#;
        let clean = HtmlSanitizer::sanitize(js_link).unwrap();
        assert!(!clean.contains("javascript:"));
        assert!(!clean.contains("onmouseover"));
        assert!(clean.contains(r#"href="https://example.com/floorplan""#));
        assert!(clean.contains(r#"rel="noopener noreferrer""#));
    }
}
