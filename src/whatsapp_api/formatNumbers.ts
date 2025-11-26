export function getWhatsAppId(rawId: string) {
  let suffix =
    rawId.split("@").length > 1 ? `@${rawId.split("@")[1]}` : "@s.whatsapp.net";
  let id = rawId.replace(/[^\d+]/g, "");

  if (!id.startsWith("+")) {
    id = `+${id}`;
  }

  if (id.startsWith("+55") && id.length === 14) {
    const ddd = Number(id.slice(3, 5));
    if (ddd >= 31) {
      // remove nono dígito
      id = id.slice(0, 5) + id.slice(6);
    }
  }
  id = id.replace("+", "") + suffix;

  return id;
}

export function revWhatsAppId(rawId: string) {
  let id = rawId.replace(/[^\d+]/g, "");

  if (!id.startsWith("+")) {
    id = `+${id}`;
  }

  if (id.startsWith("+55") && id.length === 13) {
    const ddd = Number(id.slice(3, 5));
    if (ddd >= 31) {
      // remove nono dígito
      id = id.slice(0, 5) + "9" + id.slice(5);
    }
  }
  return id.replace("+", "");
}
