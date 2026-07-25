export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface EmailPasswordCredentials {
  email: string;
  password: string;
}
