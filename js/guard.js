export function protectPage(expectedRole) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        reject("NO_USER");
        return;
      }

      const snap = await getDoc(doc(db, "users", user.uid));

      if (!snap.exists()) {
        reject("NO_PROFILE");
        return;
      }

      const data = snap.data();

      if (!data.approved || data.role !== expectedRole) {
        reject("ACCESS_DENIED");
        return;
      }

      resolve({ user, data });
    });
  });
}
