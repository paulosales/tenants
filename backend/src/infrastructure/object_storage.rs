use async_trait::async_trait;
use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::Client;
use sha2::{Digest, Sha256};

use crate::domain::{
    errors::{DomainError, DomainResult},
    ports::MediaStoragePort,
};

type HmacSha256 = Hmac<Sha256>;

pub const MAX_PROPERTY_PHOTO_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VerifiedImageFormat {
    pub content_type: &'static str,
    pub extension: &'static str,
}

/// Validates uploaded photo size, declared MIME type, and actual binary file magic bytes (CWE-434).
pub fn detect_verified_image_format(
    declared_content_type: &str,
    bytes: &[u8],
) -> DomainResult<VerifiedImageFormat> {
    if bytes.is_empty() {
        return Err(DomainError::ValidationError(
            "Uploaded image file cannot be empty".into(),
        ));
    }
    if bytes.len() > MAX_PROPERTY_PHOTO_BYTES {
        return Err(DomainError::ValidationError(
            "Uploaded image exceeds maximum 5 MB file size limit".into(),
        ));
    }

    let normalized_ct = declared_content_type
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();

    let magic = if bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        Some(VerifiedImageFormat {
            content_type: "image/jpeg",
            extension: "jpg",
        })
    } else if bytes.len() >= 8 && bytes[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
        Some(VerifiedImageFormat {
            content_type: "image/png",
            extension: "png",
        })
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(VerifiedImageFormat {
            content_type: "image/webp",
            extension: "webp",
        })
    } else {
        None
    };

    let detected = magic.ok_or_else(|| {
        DomainError::ValidationError(
            "Unsupported or corrupted image file. Only genuine JPEG, PNG, and WebP images are permitted.".into(),
        )
    })?;

    if !normalized_ct.is_empty()
        && normalized_ct != detected.content_type
        && !(normalized_ct == "image/jpg" && detected.content_type == "image/jpeg")
    {
        return Err(DomainError::ValidationError(
            "Image Content-Type does not match detected file signature".into(),
        ));
    }

    Ok(detected)
}

fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> DomainResult<Vec<u8>> {
    let mut mac = HmacSha256::new_from_slice(key)
        .map_err(|e| DomainError::Internal(format!("SigV4 HMAC initialization failed: {}", e)))?;
    mac.update(data);
    Ok(mac.finalize().into_bytes().to_vec())
}

/// S3-compatible CDN adapter implementing `MediaStoragePort` using AWS Signature V4.
/// Works seamlessly with MinIO in local development and AWS S3 / CloudFront in production.
#[derive(Clone)]
pub struct S3ObjectStorage {
    client: Client,
    endpoint: String,
    bucket: String,
    region: String,
    access_key: String,
    secret_key: String,
    cdn_base_url: String,
}

impl S3ObjectStorage {
    pub fn new(
        endpoint: String,
        bucket: String,
        region: String,
        access_key: String,
        secret_key: String,
        cdn_base_url: String,
    ) -> Self {
        Self {
            client: Client::new(),
            endpoint: endpoint.trim_end_matches('/').to_string(),
            bucket: bucket.trim_matches('/').to_string(),
            region,
            access_key,
            secret_key,
            cdn_base_url: cdn_base_url.trim_end_matches('/').to_string(),
        }
    }

    fn extract_host(&self) -> String {
        self.endpoint
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .split('/')
            .next()
            .unwrap_or("localhost")
            .to_string()
    }

    pub fn build_public_url(&self, clean_key: &str) -> String {
        format!("{}/{}", self.cdn_base_url, clean_key.trim_start_matches('/'))
    }

    fn sign_request(
        &self,
        method: &str,
        canonical_uri: &str,
        canonical_query: &str,
        content_type: Option<&str>,
        payload_hash: &str,
        amz_date: &str,
        date_stamp: &str,
    ) -> DomainResult<String> {
        let host = self.extract_host();

        let (canonical_headers, signed_headers) = if let Some(ct) = content_type {
            (
                format!(
                    "content-type:{}\nhost:{}\nx-amz-content-sha256:{}\nx-amz-date:{}\n",
                    ct, host, payload_hash, amz_date
                ),
                "content-type;host;x-amz-content-sha256;x-amz-date",
            )
        } else {
            (
                format!(
                    "host:{}\nx-amz-content-sha256:{}\nx-amz-date:{}\n",
                    host, payload_hash, amz_date
                ),
                "host;x-amz-content-sha256;x-amz-date",
            )
        };

        let canonical_request = format!(
            "{}\n{}\n{}\n{}\n{}\n{}",
            method, canonical_uri, canonical_query, canonical_headers, signed_headers, payload_hash
        );

        let scope = format!("{}/{}/s3/aws4_request", date_stamp, self.region);
        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{}\n{}\n{}",
            amz_date,
            scope,
            sha256_hex(canonical_request.as_bytes())
        );

        let k_secret = format!("AWS4{}", self.secret_key);
        let k_date = hmac_sha256(k_secret.as_bytes(), date_stamp.as_bytes())?;
        let k_region = hmac_sha256(&k_date, self.region.as_bytes())?;
        let k_service = hmac_sha256(&k_region, b"s3")?;
        let k_signing = hmac_sha256(&k_service, b"aws4_request")?;
        let signature = hex::encode(hmac_sha256(&k_signing, string_to_sign.as_bytes())?);

        Ok(format!(
            "AWS4-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
            self.access_key, scope, signed_headers, signature
        ))
    }

    /// Ensures the configured bucket exists with public-read object access for CDN delivery,
    /// and uploads seed images in development mode if missing.
    pub async fn ensure_bucket_and_seed(&self, seed_dir: Option<&std::path::Path>) {
        let canonical_uri = format!("/{}", self.bucket);
        let bucket_url = format!("{}{}", self.endpoint, canonical_uri);

        let now = Utc::now();
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
        let date_stamp = now.format("%Y%m%d").to_string();
        let empty_hash = sha256_hex(b"");

        if let Ok(auth) = self.sign_request("HEAD", &canonical_uri, "", None, &empty_hash, &amz_date, &date_stamp) {
            let exists = self
                .client
                .head(&bucket_url)
                .header("x-amz-date", &amz_date)
                .header("x-amz-content-sha256", &empty_hash)
                .header("Authorization", auth)
                .send()
                .await
                .map(|r| r.status().is_success())
                .unwrap_or(false);

            if !exists {
                if let Ok(create_auth) = self.sign_request("PUT", &canonical_uri, "", None, &empty_hash, &amz_date, &date_stamp) {
                    let _ = self
                        .client
                        .put(&bucket_url)
                        .header("x-amz-date", &amz_date)
                        .header("x-amz-content-sha256", &empty_hash)
                        .header("Authorization", create_auth)
                        .send()
                        .await;
                }
            }
        }

        // Apply read-only anonymous GetObject CDN policy to bucket so <img> CDN URLs serve publicly.
        let policy_json = format!(
            r#"{{"Version":"2012-10-17","Statement":[{{"Effect":"Allow","Principal":{{"AWS":["*"]}},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::{}/*"]}}]}}"#,
            self.bucket
        );
        let policy_hash = sha256_hex(policy_json.as_bytes());
        let policy_url = format!("{}/{}?policy", self.endpoint, self.bucket);
        if let Ok(policy_auth) = self.sign_request(
            "PUT",
            &canonical_uri,
            "policy=",
            Some("application/json"),
            &policy_hash,
            &amz_date,
            &date_stamp,
        ) {
            let _ = self
                .client
                .put(&policy_url)
                .header("Content-Type", "application/json")
                .header("x-amz-date", &amz_date)
                .header("x-amz-content-sha256", &policy_hash)
                .header("Authorization", policy_auth)
                .body(policy_json)
                .send()
                .await;
        }

        if let Some(dir) = seed_dir {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("png") {
                        if let (Some(fname), Ok(bytes)) =
                            (path.file_name().and_then(|s| s.to_str()), std::fs::read(&path))
                        {
                            let key = format!("seed/{}", fname);
                            let _ = self.upload_object(&key, "image/png", &bytes).await;
                        }
                    }
                }
            }
        }
    }
}

#[async_trait]
impl MediaStoragePort for S3ObjectStorage {
    async fn upload_object(
        &self,
        key: &str,
        content_type: &str,
        bytes: &[u8],
    ) -> DomainResult<String> {
        let clean_key = key.trim_start_matches('/');
        let canonical_uri = format!("/{}/{}", self.bucket, clean_key);
        let url = format!("{}{}", self.endpoint, canonical_uri);

        let now = Utc::now();
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
        let date_stamp = now.format("%Y%m%d").to_string();
        let payload_hash = sha256_hex(bytes);

        let auth_header = self.sign_request(
            "PUT",
            &canonical_uri,
            "",
            Some(content_type),
            &payload_hash,
            &amz_date,
            &date_stamp,
        )?;

        let resp = self
            .client
            .put(&url)
            .header("Content-Type", content_type)
            .header("x-amz-date", &amz_date)
            .header("x-amz-content-sha256", &payload_hash)
            .header("Authorization", auth_header)
            .body(bytes.to_vec())
            .send()
            .await
            .map_err(|e| DomainError::Internal(format!("CDN storage upload request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::error!(status = %status, body = %body, "S3/MinIO PUT upload rejected");
            return Err(DomainError::Internal("Failed to upload photo to media CDN".into()));
        }

        Ok(self.build_public_url(clean_key))
    }

    async fn delete_object(&self, key: &str) -> DomainResult<()> {
        let clean_key = key.trim_start_matches('/');
        let canonical_uri = format!("/{}/{}", self.bucket, clean_key);
        let url = format!("{}{}", self.endpoint, canonical_uri);

        let now = Utc::now();
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
        let date_stamp = now.format("%Y%m%d").to_string();
        let payload_hash = sha256_hex(b"");

        let auth_header = self.sign_request(
            "DELETE",
            &canonical_uri,
            "",
            None,
            &payload_hash,
            &amz_date,
            &date_stamp,
        )?;

        let resp = self
            .client
            .delete(&url)
            .header("x-amz-date", &amz_date)
            .header("x-amz-content-sha256", &payload_hash)
            .header("Authorization", auth_header)
            .send()
            .await
            .map_err(|e| DomainError::Internal(format!("CDN storage delete failed: {}", e)))?;

        if !resp.status().is_success() && resp.status().as_u16() != 404 {
            tracing::warn!(status = %resp.status(), key = %clean_key, "S3/MinIO DELETE returned non-success");
        }
        Ok(())
    }
}

/// Offline / test-safe `MediaStoragePort` double returning deterministic CDN URLs without network calls.
#[derive(Debug, Default, Clone)]
pub struct InMemoryTestMediaStorage {
    pub cdn_base_url: String,
}

#[async_trait]
impl MediaStoragePort for InMemoryTestMediaStorage {
    async fn upload_object(
        &self,
        key: &str,
        _content_type: &str,
        _bytes: &[u8],
    ) -> DomainResult<String> {
        let base = if self.cdn_base_url.is_empty() {
            "http://localhost:9000/property-media"
        } else {
            self.cdn_base_url.trim_end_matches('/')
        };
        Ok(format!("{}/{}", base, key.trim_start_matches('/')))
    }

    async fn delete_object(&self, _key: &str) -> DomainResult<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_magic_bytes_accepts_png_and_rejects_spoofed_svg() {
        let valid_png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00];
        let fmt = detect_verified_image_format("image/png", &valid_png).unwrap();
        assert_eq!(fmt.extension, "png");

        let spoofed_svg = b"<svg onload=alert(1)></svg>";
        let err = detect_verified_image_format("image/png", spoofed_svg).unwrap_err();
        assert!(matches!(err, DomainError::ValidationError(_)));

        let mismatched = detect_verified_image_format("image/jpeg", &valid_png).unwrap_err();
        assert!(matches!(mismatched, DomainError::ValidationError(_)));
    }

    #[test]
    fn test_sigv4_header_format() {
        let storage = S3ObjectStorage::new(
            "http://minio:9000".into(),
            "property-media".into(),
            "us-east-1".into(),
            "minioadmin_dev".into(),
            "minioadmin_dev_secret".into(),
            "http://localhost:9000/property-media".into(),
        );
        let auth = storage
            .sign_request(
                "PUT",
                "/property-media/properties/abc/123.png",
                "",
                Some("image/png"),
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "20261111T000000Z",
                "20261111",
            )
            .unwrap();
        assert!(auth.starts_with("AWS4-HMAC-SHA256 Credential=minioadmin_dev/20261111/us-east-1/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature="));
        assert_eq!(
            storage.build_public_url("properties/abc/123.png"),
            "http://localhost:9000/property-media/properties/abc/123.png"
        );
    }
}
