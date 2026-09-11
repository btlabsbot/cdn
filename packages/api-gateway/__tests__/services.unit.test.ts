// @ts-nocheck
import { AuthService, createAuthService } from "../src/services/auth.service";
import { nodeService } from "../src/services/node.service";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { loadUsers, saveUsers } from "../src/services/credentialStore";

beforeEach(() => {
  // Clear persisted auth data between tests
  const dataDir = process.env.DATA_DIR ?? join(process.cwd(), "data");
  const authFile = join(dataDir, "auth.json");
  if (existsSync(authFile)) {
    rmSync(authFile);
  }
  ;(nodeService as any).nodes.clear();
});

const baseConfig = {
  port: 3000,
  adminUsername: "admin",
  adminPassword: "admin",
  authSecret: "test-secret-change-me",
  nodeAuthSecret: "test-node-secret-change-me",
  corsOrigins: ["http://localhost:3001"],
};

describe("AuthService", () => {
  describe("with registration disabled", () => {
    const config = { ...baseConfig, allowRegistration: false };

    let authService: AuthService;

    beforeEach(() => {
      authService = createAuthService(config);
    });

    describe("login", () => {
      it("should return token for valid credentials", () => {
        const token = authService.login("admin", "admin");
        expect(token).toBeDefined();
        expect(typeof token).toBe("string");
      });

      it("should return null for invalid credentials", () => {
        const token = authService.login("admin", "wrongpassword");
        expect(token).toBeNull();
      });
    });

    describe("verify", () => {
      it("should verify valid token", () => {
        const token = authService.login("admin", "admin");
        expect(token).toBeDefined();
        const payload = authService.verify(token);
        expect(payload).toBeDefined();
        expect(payload?.sub).toBe("admin");
      });

      it("should return null for invalid token", () => {
        const payload = authService.verify("invalid-token");
        expect(payload).toBeNull();
      });
    });

    describe("isRegistrationAllowed", () => {
      it("should return false", () => {
        expect(authService.isRegistrationAllowed()).toBe(false);
      });
    });

    describe("register", () => {
      it("should reject registration when not allowed", () => {
        const result = authService.register("newuser", "password123");
        expect(result).toEqual({ error: "El registro de nuevas cuentas está desactivado" });
      });

      // Note: When registration is disabled, attempting to register
      // always returns "registration disabled" regardless of whether
      // the user exists - the check for allowRegistration happens first.
    });
  });

  describe("with registration enabled", () => {
    const config = { ...baseConfig, allowRegistration: true };

    let authService: AuthService;

    beforeEach(() => {
      authService = createAuthService(config);
    });

    describe("register", () => {
      it("should register a new user", () => {
        const result = authService.register("newuser", "password123");
        expect(result).not.toHaveProperty("error");
        expect(result).toHaveProperty("token");
      });

      it("should reject registration when user already exists", () => {
        authService.register("existinguser", "password123");
        const result = authService.register("existinguser", "password123");
        expect(result).toEqual({ error: "Ese usuario ya existe" });
      });
    });
  });
});

describe("NodeService", () => {
  beforeEach(() => {
    // Clear the node service cache
    ;(nodeService as any).nodes.clear();
  });

  describe("register", () => {
    it("should register a new node", () => {
      const node = nodeService.register({ hostname: "test-node", region: "us-east" });
      expect(node).toBeDefined();
      expect(node.hostname).toBe("test-node");
      expect(node.region).toBe("us-east");
      expect(node.status).toBe("online");
      expect(node.id).toBeDefined();
    });

    it("should update existing node by hostname", () => {
      const node1 = nodeService.register({ hostname: "existing", region: "us-east" });
      const node2 = nodeService.register({ hostname: "existing", region: "eu-west" });
      expect(node2.region).toBe("eu-west");
      expect(node2.status).toBe("online");
    });
  });

  describe("heartbeat", () => {
    it("should update node stats via heartbeat", () => {
      const node = nodeService.register({ hostname: "heartbeat-node", region: "eu-west" });
      const result = nodeService.heartbeat(node.id, {
        status: "online",
        cacheHitRate: 0.9,
        diskUsagePct: 20,
        latencyMs: 50,
      });
      expect(result).toBeDefined();
      expect(result.cacheHitRate).toBe(0.9);
      expect(result.diskUsagePct).toBe(20);
      expect(result.latencyMs).toBe(50);
    });

    it("should return undefined for non-existent node", () => {
      const result = nodeService.heartbeat("non-existent-id", {
        status: "online",
        cacheHitRate: 0.9,
      });
      expect(result).toBeUndefined();
    });
  });

  describe("list", () => {
    it("should return empty list initially", () => {
      const nodes = nodeService.list();
      expect(nodes).toEqual([]);
    });
  });

  describe("getById", () => {
    it("should return node by id", () => {
      const node = nodeService.register({ hostname: "find-me", region: "ap-south" });
      const result = nodeService.getById(node.id);
      expect(result).toBeDefined();
      expect(result.hostname).toBe("find-me");
    });

    it("should return undefined for non-existent id", () => {
      const result = nodeService.getById("non-existent-id");
      expect(result).toBeUndefined();
    });
  });
});