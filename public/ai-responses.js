// Simple AI response generator for bots
function generateBotResponse(userMessage) {
  const msg = userMessage.toLowerCase().trim();
  
  // Greeting responses
  if (msg.match(/^(hi|hello|hey|what'?s up|howdy)/i)) {
    return ['Hey there! How are you doing?', 'Hi! Nice to meet you!', 'Hello! How\'s your day going?'][Math.floor(Math.random() * 3)];
  }
  
  // How are you questions
  if (msg.match(/how are you|how'?s it|how'?re you/i)) {
    return ['I\'m doing great, thanks for asking! How about you?', 'Pretty good! How are you?', 'Doing well! What about you?'][Math.floor(Math.random() * 3)];
  }
  
  // Name questions
  if (msg.match(/what'?s your name|who are you|name/i)) {
    const names = ['I\'m an AI bot here to chat!', 'I\'m a friendly AI! What\'s your name?', 'You can call me Bot! What do they call you?'];
    return names[Math.floor(Math.random() * names.length)];
  }
  
  // Where/Location questions
  if (msg.match(/where are you|location|country|city/i)) {
    return ['I\'m everywhere and nowhere - I\'m a bot! 😄 Where are you from?', 'I exist in the cloud! How about you?', 'I\'m in the digital realm! What about you?'][Math.floor(Math.random() * 3)];
  }
  
  // Work/Job questions
  if (msg.match(/what do you do|job|work|profession/i)) {
    return ['I chat with people all day! It\'s pretty fun. What do you do?', 'I\'m a professional conversationalist! What\'s your job?', 'I spend my time chatting. What do you do for work?'][Math.floor(Math.random() * 3)];
  }
  
  // Age questions
  if (msg.match(/how old|age|born when/i)) {
    return ['I\'m as old as this conversation! How old are you?', 'Age is just a number... and I\'m a bot! 😄', 'I don\'t really age. How about you?'][Math.floor(Math.random() * 3)];
  }
  
  // Interests questions
  if (msg.match(/interested in|like to|enjoy|hobby|hobby|fun/i)) {
    return ['I like chatting with interesting people like you! What are your interests?', 'I enjoy good conversations. What do you like to do?', 'I\'m into meeting new people and learning about them!'][Math.floor(Math.random() * 3)];
  }
  
  // Music
  if (msg.match(/music|song|artist|listen/i)) {
    return ['I love music! What\'s your favorite genre?', 'Music is amazing! Do you play any instruments?', 'What kind of music do you listen to?'][Math.floor(Math.random() * 3)];
  }
  
  // Movies/Shows
  if (msg.match(/movie|film|show|watch|netflix/i)) {
    return ['What\'s your favorite movie?', 'Are you a movie person or show binger?', 'I love talking about movies! What do you watch?'][Math.floor(Math.random() * 3)];
  }
  
  // Sports
  if (msg.match(/sport|football|soccer|basketball|game|team/i)) {
    return ['Do you play any sports?', 'Are you into sports?', 'What\'s your favorite sport?'][Math.floor(Math.random() * 3)];
  }
  
  // Travel
  if (msg.match(/travel|visit|trip|vacation|country/i)) {
    return ['Travel is amazing! Where have you been?', 'Do you travel a lot? Where\'d you like to go?', 'I love hearing about places people visit!'][Math.floor(Math.random() * 3)];
  }
  
  // Food
  if (msg.match(/food|eat|favorite meal|cooking|chef/i)) {
    return ['What\'s your favorite food?', 'Do you like to cook?', 'Are you a foodie? What\'s your favorite cuisine?'][Math.floor(Math.random() * 3)];
  }
  
  // School/Learning
  if (msg.match(/school|study|college|university|learn|education/i)) {
    return ['What are you studying?', 'Do you enjoy learning?', 'Are you in school? What\'s your major?'][Math.floor(Math.random() * 3)];
  }
  
  // Technology
  if (msg.match(/tech|computer|code|programming|software/i)) {
    return ['I love tech! Are you a programmer?', 'What\'s your favorite tech?', 'Do you code?'][Math.floor(Math.random() * 3)];
  }
  
  // Compliments
  if (msg.match(/nice|cool|awesome|great|amazing|wonderful/i)) {
    return ['Thanks! You seem pretty cool too!', 'Right back at you! 😄', 'That\'s sweet of you to say!'][Math.floor(Math.random() * 3)];
  }
  
  // Yes responses
  if (msg.match(/^(yes|yep|yeah|yup|sure|ok|okay)/i)) {
    return ['Nice! Tell me more', 'That\'s cool! Go on', 'Awesome! 😄'][Math.floor(Math.random() * 3)];
  }
  
  // No responses
  if (msg.match(/^(no|nope|nah|not really)/i)) {
    return ['No worries! What about something else?', 'That\'s cool too. What do you prefer?', 'Fair enough!'][Math.floor(Math.random() * 3)];
  }
  
  // Jokes
  if (msg.match(/joke|funny|laugh|haha|lol/i)) {
    return ['Why did the AI go to school? To improve its learning model! 😄', 'I\'d tell you a programming joke but I\'m worried it won\'t execute properly!', 'Why do bots make terrible comedians? We take everything literally!'][Math.floor(Math.random() * 3)];
  }
  
  // Default responses for random messages
  const defaults = [
    'That\'s interesting! Tell me more',
    'I see! What do you mean by that?',
    'Oh cool! How\'d that happen?',
    'Haha, nice! What else?',
    'Really? That\'s neat!',
    'I like where this is going',
    'That sounds fun! What\'s it like?',
    'Interesting! Keep going',
  ];
  
  return defaults[Math.floor(Math.random() * defaults.length)];
}
