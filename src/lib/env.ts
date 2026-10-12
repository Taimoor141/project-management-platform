export type AppEnv = {
  APP_NAME: string;
  NEXTAUTH_URL: string;
  NEXTAUTH_SECRET: string;
  DATABASE_URL: string;
};

export function getAppEnv(env: Partial<Record<string, string | undefined>>): AppEnv {
  return {
    APP_NAME: "ProjectFlow",
    NEXTAUTH_URL: env.NEXTAUTH_URL ?? "http://localhost:3000",
    NEXTAUTH_SECRET: env.NEXTAUTH_SECRET ?? "development-secret-change-me",
    DATABASE_URL:
      env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/project_management",
  };
}
