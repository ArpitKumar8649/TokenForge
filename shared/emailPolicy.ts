/**
 * Established consumer and widely used international mailbox providers accepted
 * for first-party TokenForge authentication. Deliberately excludes arbitrary
 * work and custom domains so account creation remains a curated beta surface.
 */
export const ESTABLISHED_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in", "yahoo.co.jp", "yahoo.fr", "yahoo.de",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "tuta.com", "tutamail.com", "hushmail.com", "fastmail.com",
  "zoho.com", "mail.com", "gmx.com", "gmx.net", "gmx.de", "web.de", "t-online.de", "freenet.de", "online.de",
  "qq.com", "163.com", "126.com", "yeah.net", "sina.com", "sina.cn", "sohu.com", "foxmail.com",
  "naver.com", "daum.net", "hanmail.net", "yandex.com", "yandex.ru", "mail.ru", "bk.ru", "inbox.ru", "list.ru",
  "rediffmail.com", "rediff.com", "seznam.cz", "centrum.cz", "wp.pl", "o2.pl", "interia.pl",
  "libero.it", "virgilio.it", "orange.fr", "laposte.net", "free.fr", "wanadoo.fr",
  "btinternet.com", "sky.com", "talktalk.net", "virginmedia.com", "telus.net", "rogers.com", "bell.net", "shaw.ca",
  "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "claro.net.br", "terra.com.mx", "prodigy.net.mx",
] as const;

const ESTABLISHED_EMAIL_DOMAIN_SET = new Set<string>(ESTABLISHED_EMAIL_DOMAINS);

export const ESTABLISHED_EMAIL_DOMAIN_GUIDANCE = "gmail.com, outlook.com, yahoo.com, icloud.com, proton.me, qq.com, 163.com, naver.com, yandex.com, gmx.com, or web.de";

export function emailDomain(value: string) {
  const normalized = value.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex !== normalized.indexOf("@") || atIndex === normalized.length - 1) return null;
  return normalized.slice(atIndex + 1);
}

export function isEstablishedEmailAddress(value: string) {
  const domain = emailDomain(value);
  return Boolean(domain && ESTABLISHED_EMAIL_DOMAIN_SET.has(domain));
}
