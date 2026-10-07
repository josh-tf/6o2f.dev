// Shared by the manage page and the public poll page. Everything is written with textContent.
export function renderBars(ul, options, results) {
  ul.replaceChildren();
  const max = Math.max(0, ...results.counts);
  options.forEach((label, i) => {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'bhead';
    const name = document.createElement('span');
    name.textContent = label;
    const num = document.createElement('span');
    num.className = 'mono';
    num.textContent = `${results.percents[i]}% (${results.counts[i]})`;
    head.append(name, num);
    const track = document.createElement('div');
    track.className = 'track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.style.width = `${results.percents[i]}%`;
    if (results.counts[i] === max && max > 0) fill.className = 'lead';
    track.append(fill);
    li.append(head, track);
    ul.append(li);
  });
}
export const votesText = (n) => `${n} ${n === 1 ? 'voter' : 'voters'}`;
