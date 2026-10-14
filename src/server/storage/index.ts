import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3-compatible object storage: R2, Alibaba Cloud OSS, MinIO, S3. The bucket
// is private; readers get short-lived signed URLs.

const SIGNED_URL_SECONDS = 60 * 60;

export function storageConfigured() {
  return Boolean(
    process.env.STORAGE_BUCKET &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY,
  );
}

let client: S3Client | undefined;

function getClient() {
  client ??= new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    region: process.env.STORAGE_REGION || "auto",
    // MinIO needs path-style URLs; R2, OSS and S3 take either or virtual-host.
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "",
    },
  });
  return client;
}

function bucket() {
  const name = process.env.STORAGE_BUCKET;
  if (!name) throw new Error("STORAGE_BUCKET is not set");
  return name;
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await getClient().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

// With `download`, the browser saves the object under that file name
// instead of showing it.
export function signedUrl(key: string, options: { download?: string } = {}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: options.download
      ? `attachment; filename="${options.download}"`
      : undefined,
  });
  return getSignedUrl(getClient(), command, { expiresIn: SIGNED_URL_SECONDS });
}

export async function deleteObject(key: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

// Deletes every object whose key starts with the prefix, such as
// "images/<userId>/". Returns how many it deleted. The prefix must end with
// "/" and name a folder, so a bad value can't empty the bucket. Objects go one
// at a time: R2, OSS and MinIO all accept a plain DELETE.
export async function deletePrefix(prefix: string): Promise<number> {
  if (!prefix.endsWith("/") || prefix.replaceAll("/", "") === "") {
    throw new Error(`Refusing to delete prefix "${prefix}": it must name a folder`);
  }
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await getClient().send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
    );
    for (const { Key } of page.Contents ?? []) {
      if (!Key) continue;
      await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key }));
      deleted++;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}
