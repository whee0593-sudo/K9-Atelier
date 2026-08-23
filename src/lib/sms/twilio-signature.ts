import { createHmac, timingSafeEqual } from "node:crypto";

export function isValidTwilioSignature(input: {
  authToken: string;
  signature: string;
  url: string;
  params: Record<string, string>;
}) {
  const data =
    input.url +
    Object.keys(input.params)
      .sort()
      .map((key) => key + input.params[key])
      .join("");
  const expected = createHmac("sha1", input.authToken)
    .update(data, "utf8")
    .digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(input.signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
