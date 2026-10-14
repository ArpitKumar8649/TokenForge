try {
  const key = "sk-••••vr9b";
  new Headers({ Authorization: `Bearer ${key}` });
} catch (e: any) {
  console.log("Headers test:", e.message);
}
