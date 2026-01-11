const doLogIn = (username: string) => {
  localStorage.setItem('username', username);
  localStorage.setItem('isLoggedIn', 'true');
};

const isLoggedIn = () => {
  return Boolean(localStorage.getItem('isLoggedIn'));
};

const logOut = () => {
  localStorage.removeItem('username');
  localStorage.removeItem('isLoggedIn');
};

const authService = {
  doLogIn,
  isLoggedIn,
  logOut,
};

export default authService;
