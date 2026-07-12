export async function requireAuthenticated(isAuthenticated) {
  if (!(await isAuthenticated())) {
    const error = new Error("Sign in to use the mascot studio.");
    error.status = 401;
    throw error;
  }
}
