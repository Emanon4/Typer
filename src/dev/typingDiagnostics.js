// Opt-in local measurements. This module is excluded from production builds.
export function mountTypingDiagnostics() {
  const panel = document.createElement("aside");
  panel.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:99999;background:#fff;color:#222;padding:12px;font:12px monospace;width:370px;max-height:35vh;overflow:auto";
  panel.innerHTML = '<button type="button">Start measurement</button> <button type="button">Stop measurement</button><pre aria-label="Typing measurements">Ready</pre>';
  document.body.append(panel);
  const output = panel.querySelector("pre");
  let active = false, start = 0, previous = 0, frame, frames = [], draws = [], tasks = [], initial = 0;
  const count = () => document.querySelectorAll(".live-ink .ink-glyph").length;
  const summary = values => {
    if (!values.length) return {count:0};
    const sorted = [...values].sort((a,b)=>a-b);
    return {count:values.length,mean:+(values.reduce((a,b)=>a+b,0)/values.length).toFixed(2),p95:+sorted[Math.floor((sorted.length-1)*.95)].toFixed(2),max:+sorted.at(-1).toFixed(2)};
  };
  const report = () => ({elapsedMs:Math.round(performance.now()-start),newGlyphs:count()-initial,frameMs:summary(frames),drawMs:summary(draws),longTasks:summary(tasks),viewport:[innerWidth,innerHeight,devicePixelRatio]});
  const tick = now => {
    if (!active) return;
    if (previous) frames.push(now-previous);
    previous = now;
    output.textContent = JSON.stringify(report(),null,2);
    if (count()-initial >= 60) active=false;
    else frame = requestAnimationFrame(tick);
  };
  panel.querySelectorAll("button")[0].onclick = () => {
    cancelAnimationFrame(frame);
    active=true;start=performance.now();previous=0;frames=[];draws=[];tasks=[];initial=count();
    frame=requestAnimationFrame(tick);
    document.querySelector('textarea')?.focus();
  };
  panel.querySelectorAll("button")[1].onclick = () => {active=false;cancelAnimationFrame(frame);output.textContent=JSON.stringify(report(),null,2);};
  document.addEventListener("typer:canvas-profile",event=>{if(active)draws.push(event.detail.ms);});
  if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
    new PerformanceObserver(list=>{if(active)tasks.push(...list.getEntries().map(entry=>entry.duration));}).observe({type:"longtask"});
  }
}
