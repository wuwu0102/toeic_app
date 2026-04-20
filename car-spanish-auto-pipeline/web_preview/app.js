async function loadData() {
  const meta = document.getElementById('meta');
  const tbody = document.getElementById('rows');
  tbody.innerHTML = '';
  try {
    const resp = await fetch('/api/subtitles');
    const data = await resp.json();
    meta.textContent = `共 ${data.length} 段`;
    data.forEach((row, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${row.start}</td>
        <td>${row.end}</td>
        <td>${row.es || ''}</td>
        <td>${row.zh || ''}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    meta.textContent = `載入失敗: ${err}`;
  }
}

document.getElementById('reload').addEventListener('click', loadData);
loadData();
