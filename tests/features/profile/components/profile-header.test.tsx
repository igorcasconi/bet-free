import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileHeader } from "@/features/profile/components/profile-header";
import type { ProfileIdentity } from "@/features/profile/types";

// Radix's Avatar image loads via `new window.Image()` + a `load` event that
// never fires for real network requests under jsdom. Stub it so `complete`/
// `naturalWidth` report "loaded" synchronously, matching how the browser
// resolves an already-cached image.
class InstantlyLoadedImage {
  complete = true;
  naturalWidth = 1;
  addEventListener() {}
  removeEventListener() {}
  src = "";
}

beforeEach(() => {
  vi.stubGlobal("Image", InstantlyLoadedImage);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function identity(overrides: Partial<ProfileIdentity> = {}): ProfileIdentity {
  return {
    displayName: null,
    email: null,
    avatarUrl: null,
    ...overrides,
  };
}

describe("ProfileHeader", () => {
  it("renders the avatar image when avatarUrl is present", () => {
    render(
      <ProfileHeader
        identity={identity({
          displayName: "Ana Silva",
          avatarUrl: "https://example.com/avatar.png",
        })}
      />,
    );

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/avatar.png",
    );
  });

  it("renders initials fallback when avatarUrl is absent but displayName is present", () => {
    render(<ProfileHeader identity={identity({ displayName: "Ana Silva" })} />);

    expect(screen.getByText("AS")).toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
  });

  it('shows "Usuário" and a neutral fallback when both avatarUrl and displayName are absent', () => {
    render(<ProfileHeader identity={identity()} />);

    expect(screen.getByText("Usuário")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("omits the email line when email is absent", () => {
    render(<ProfileHeader identity={identity({ displayName: "Ana Silva" })} />);

    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
