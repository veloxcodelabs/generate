/**
 * Помощен помощен модул за надеждни мрежови заявки
 * Предпазва приложението от сривове тип "Unexpected token '<' / 'A'"
 * при получаване на HTML страници или грешки от Vercel / прокси.
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  details?: any;
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const fetchOptions: RequestInit = {
      cache: 'no-store',
      ...options,
      headers: {
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
        ...options?.headers,
      },
    };

    const res = await fetch(url, fetchOptions);

    // 304 Not Modified се счита за успешен, но без ново тяло
    if (res.status === 304) {
      return {
        ok: true,
        status: 304,
        data: undefined,
      };
    }

    const text = await res.text();

    let parsedJson: any = null;
    if (text && text.trim().length > 0) {
      try {
        parsedJson = JSON.parse(text);
      } catch {
        // Отговорът не е JSON (възможно е Vercel HTML грешка или 502 Bad Gateway)
      }
    }

    if (!res.ok) {
      // Извличаме съобщение за грешка от JSON или от чистия текст
      let errorMsg: string;
      if (parsedJson && typeof parsedJson.error === 'string') {
        errorMsg = parsedJson.error;
      } else if (parsedJson && typeof parsedJson.message === 'string') {
        errorMsg = parsedJson.message;
      } else if (text && text.length > 0 && text.length < 150 && !text.includes('<html')) {
        errorMsg = text;
      } else if (text && text.includes('A server error has occurred')) {
        errorMsg = 'Възникна Vercel сървърна грешка. Моля, проверете дали функциите са деплойнати коректно.';
      } else {
        errorMsg = `Сървърът върна грешка с код ${res.status} (${res.statusText || 'Error'}).`;
      }

      return {
        ok: false,
        status: res.status,
        error: errorMsg,
        details: parsedJson?.details || (parsedJson ? undefined : text.slice(0, 200)),
      };
    }

    // Успешен отговор
    return {
      ok: true,
      status: res.status,
      data: parsedJson !== null ? parsedJson : (text as unknown as T),
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Грешка при свързване със сървъра. Проверете интернет връзката си.',
    };
  }
}
