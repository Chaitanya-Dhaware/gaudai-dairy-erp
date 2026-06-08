document.addEventListener('DOMContentLoaded', function() {
  const button = document.querySelector('.chatbot-button');
  const chatbot = document.getElementById('chatbot-container'); // Assuming a container exists

  if (button) {
    button.addEventListener('click', function() {
      if (chatbot) {
        chatbot.style.display = chatbot.style.display === 'none' ? 'block' : 'none';
      }
    });
  }
});