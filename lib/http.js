import { NextResponse } from 'next/server';
export const json = (data, status = 200) => NextResponse.json(data, { status });
export const fail = (status, message) => { throw json({ error: message }, status); };
export const handle = (fn) => async (req, ctx) => {
  try { return await fn(req, ctx); }
  catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
};
