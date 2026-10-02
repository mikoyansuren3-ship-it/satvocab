/** Where this browser remembers a chosen theme. With nothing saved, the site follows the device setting. */
export const THEME_KEY = "sat-vocab:theme";

/**
 * Runs in <head> before the page paints, so a saved theme shows from the first frame
 * instead of flashing the device theme first.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
