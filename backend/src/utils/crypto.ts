import crypto from 'crypto';

const KEY_ENV = 'AI_CREDENTIALS_KEY';
const IV_LENGTH = 12;

const getKey = (): Buffer => {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    throw new Error(`環境変数 ${KEY_ENV} が設定されていません`);
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`環境変数 ${KEY_ENV} は32バイトのbase64文字列である必要があります`);
  }
  return key;
};

export const encryptSecret = (plaintext: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64')).join('.');
};

export const decryptSecret = (payload: string): string => {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('暗号化されたデータの形式が不正です');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};
