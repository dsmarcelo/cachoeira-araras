/* eslint-disable @typescript-eslint/no-unsafe-call */
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;

export const pageview = () => {
  window.fbq("track", "PageView");
};

// https://developers.facebook.com/docs/facebook-pixel/advanced/
export const event = (/** @type {any} */ name, options = {}) => {
  window.fbq("track", name, options);
};