import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { deleteObject, deletePrefix, signedUrl } from "./index";

// Signing is local: no request reaches the storage server.
beforeEach(() => {
  vi.stubEnv("STORAGE_ENDPOINT", "http://storage.test");
  vi.stubEnv("STORAGE_REGION", "us-east-1");
  vi.stubEnv("STORAGE_BUCKET", "starter");
  vi.stubEnv("STORAGE_ACCESS_KEY_ID", "key");
  vi.stubEnv("STORAGE_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("STORAGE_FORCE_PATH_STYLE", "true");
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("signs a URL that shows the object in the browser", async () => {
  const url = new URL(await signedUrl("images/u/a.png"));

  expect(url.origin + url.pathname).toBe("http://storage.test/starter/images/u/a.png");
  expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
  expect(url.searchParams.has("response-content-disposition")).toBe(false);
});

test("signs a URL that downloads the object under a file name", async () => {
  const url = new URL(await signedUrl("images/u/a.png", { download: "image-a.png" }));

  expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="image-a.png"');
});

test("deletes every object under a prefix, page by page", async () => {
  const deleted: string[] = [];
  const send = vi.spyOn(S3Client.prototype, "send").mockImplementation(async (command: unknown) => {
    if (command instanceof ListObjectsV2Command) {
      const { Prefix, ContinuationToken } = command.input;
      expect(Prefix).toBe("images/u/");
      return ContinuationToken
        ? { Contents: [{ Key: "images/u/c.png" }], IsTruncated: false }
        : { Contents: [{ Key: "images/u/a.png" }, { Key: "images/u/b.png" }], IsTruncated: true, NextContinuationToken: "2" };
    }
    if (command instanceof DeleteObjectCommand) {
      expect(command.input.Bucket).toBe("starter");
      deleted.push(command.input.Key!);
      return {};
    }
    throw new Error("unexpected command");
  });

  expect(await deletePrefix("images/u/")).toBe(3);
  expect(deleted).toEqual(["images/u/a.png", "images/u/b.png", "images/u/c.png"]);
  expect(send).toHaveBeenCalledTimes(5);
});

test("refuses a prefix that isn't a folder, so it can't empty the bucket", async () => {
  const send = vi.spyOn(S3Client.prototype, "send");

  for (const prefix of ["", "/", "images/u"]) {
    await expect(deletePrefix(prefix)).rejects.toThrow("Refusing to delete");
  }
  expect(send).not.toHaveBeenCalled();
});

test("deletes one object", async () => {
  const send = vi.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));

  await deleteObject("videos/u/a.png");

  const [command] = send.mock.calls[0] as unknown as [DeleteObjectCommand];
  expect(command).toBeInstanceOf(DeleteObjectCommand);
  expect(command.input).toEqual({ Bucket: "starter", Key: "videos/u/a.png" });
});
