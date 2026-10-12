import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      organizationId?: string;
      organizationName?: string;
      organizationCode?: string;
    };
  }

  interface User {
    id: string;
    organizationId?: string;
    organizationName?: string;
    organizationCode?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    organizationId?: string;
    organizationName?: string;
    organizationCode?: string;
  }
}
