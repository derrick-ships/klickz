export function createOtpScheduler(submit: (code: string) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  return {
    cancel,
    input(raw: string, pasted: boolean) {
      cancel();
      const value = raw.replace(/\D/g, "").slice(0, 8);
      if (value.length === 8 || (pasted && value.length === 6)) submit(value);
      else if (value.length === 6) timer = setTimeout(() => { timer = undefined; submit(value); }, 1500);
      return value;
    },
  };
}

export function normalizeOtpCode(value: string): string {
  return value.replace(/[\s-]/g, "");
}
