import 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** 401 einfach durchreichen, keinen Refresh anstoßen */
    allowAnonymous?: boolean;
    /** Für diesen Request keinen Authorization-Bearer anhängen */
    skipAuthHeader?: boolean;
  }
}