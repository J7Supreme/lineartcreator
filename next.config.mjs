/** @type {import('next').NextConfig} */
const nextConfig = {
  // Main site at / (j7sup.com)
  // Sub-site at /lineartcreator (j7sup.com/lineartcreator)
  // We don't use a global basePath here because the home page is at root /.
  // Instead, the routes are organized in the app directory:
  // app/page.tsx -> j7sup.com/
  // app/lineartcreator/page.tsx -> j7sup.com/lineartcreator
};

export default nextConfig;
