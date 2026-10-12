async function ensureAdmin() {
  const { PrismaClient } = await import('@prisma/client');
  const bcrypt = (await import('bcryptjs')).default;
  const prisma = new PrismaClient();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Workspace Admin';
  const slug = process.env.BOOTSTRAP_ADMIN_ORG_SLUG?.trim() || 'admin-workspace';
  if (!email || !password) throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD first.');
  const hash = await bcrypt.hash(password, 12);

  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: hash,
      },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
    console.log('CREATED_USER', user.email, user.id);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { name, passwordHash: hash },
    });
    console.log('UPDATED_USER', user.email, user.id);
  }

  let organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: `${name} Workspace`,
        slug,
        ownerId: user.id,
      },
      select: { id: true, name: true, slug: true },
    });
    console.log('CREATED_ORG', organization.slug, organization.id);
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId: organization.id },
    select: { id: true, role: true },
  });

  if (!membership) {
    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    console.log('CREATED_MEMBERSHIP', user.id, organization.id);
  } else {
    await prisma.organizationMember.update({
      where: { id: membership.id },
      data: { role: 'OWNER', status: 'ACTIVE' },
    });
    console.log('UPDATED_MEMBERSHIP', user.id, organization.id);
  }
}

ensureAdmin()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
