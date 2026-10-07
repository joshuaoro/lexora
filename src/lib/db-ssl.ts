/**
 * TLS for every connection to the database, verified.
 *
 * node-postgres does not encrypt unless asked, and nothing asked: until
 * 8 October every query — readings, verdicts, the children's voice recordings
 * — travelled between Vercel and Supabase in clear text, and so did every
 * backup this laptop took. The proposal promises "HTTPS / SSL certificate for
 * encrypted data transmission"; that covered the browser and stopped there.
 *
 * Supabase signs its database certificates with its own root, which no
 * operating system trusts, so "verify the certificate" needs that root. It is
 * public — Supabase publishes it — and it is embedded here rather than read
 * from a file so it travels inside the serverless bundle. Checked two ways on
 * 8 October before it was trusted: the published download, and the chain both
 * the pooler and the direct connection present, which verify against it.
 *
 *   Subject  CN=Supabase Root 2021 CA, O=Supabase Inc
 *   Valid    2021-04-28 to 2031-04-26
 *   SHA-256  80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:
 *            82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
 *
 * `tests/helpers.mjs` reads the certificate out of this file, so there is one
 * copy. Replace it before 2031, or sooner if Supabase rotates its root.
 */
export const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

/**
 * The `ssl` option for a node-postgres client or pool connecting to this URL.
 *
 * A Supabase host gets TLS verified against Supabase's root — certificate and
 * hostname both, so a server that cannot prove it is Supabase is refused, not
 * merely encrypted to. Anything else is assumed to be a Postgres on this
 * machine for development, which has no certificate to check.
 */
export function databaseSsl(connectionString: string) {
  const host = new URL(connectionString.replace(/^postgres(ql)?:/, "http:")).hostname;
  return /\.supabase\.(com|co)$/.test(host)
    ? { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true }
    : undefined;
}
