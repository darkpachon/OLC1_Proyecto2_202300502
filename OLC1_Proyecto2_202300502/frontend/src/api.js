export async function execute(source){
  const r = await fetch('/api/execute', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ source })
  });
  return r.json();
}