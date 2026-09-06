import { withSecurity } from "../../utilsAPI/withSecurity";

export const GET = withSecurity(async () => {
  return Response.json({ status: "secure_online" });
});

export const POST = withSecurity(async () => {
  return Response.json({ status: "secure_online" });
});
