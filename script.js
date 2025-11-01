// Real-time date and time
function updateDateTime() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const date = now.toLocaleDateString('en-US', options);
  const time = now.toLocaleTimeString('en-US');
  document.getElementById("datetime").textContent = `${date} | ${time}`;
}
setInterval(updateDateTime, 1000);
updateDateTime();

// Fade-in animation on scroll
const sections = document.querySelectorAll('.section');
window.addEventListener('scroll', () => {
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight - 100) {
      section.classList.add('visible');
    }
  });
});
