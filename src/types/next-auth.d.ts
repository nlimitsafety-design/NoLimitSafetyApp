import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string;
      role: "ADMIN" | "MANAGER" | "EMPLOYEE";
    };
  }

  interface User {
    id: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
