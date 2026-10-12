import { prisma } from "../src/lib/prisma";
import { registerUser } from "../src/server/auth";
import { createOrganization } from "../src/server/organizations";

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Workspace Admin";
const slug = process.env.BOOTSTRAP_ADMIN_ORG_SLUG?.trim() || "admin-workspace";

async function main() {
  if (!email || !password) throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD first.");

  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    user = await registerUser({
      name,
      email,
      password,
    });
    console.log("CREATED_USER", user.email, user.id);
  } else {
    console.log("EXISTING_USER", user.email, user.id);
  }

  const existingOrg = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (existingOrg) {
    console.log("EXISTING_ORG", existingOrg.slug, existingOrg.id);
    return;
  }

  const org = await createOrganization({
    name: `${name} Workspace`,
    slug,
    ownerId: user.id,
  });

  console.log("CREATED_ORG", org.slug, org.id);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
