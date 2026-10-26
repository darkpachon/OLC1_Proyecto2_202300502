import { instance } from '@viz-js/viz';

let vizInstance = null;

export async function renderDotToSvg(dot){
  if(!vizInstance){
    vizInstance = await instance();
  }
  return vizInstance.renderString(dot, { format: 'svg' });
}