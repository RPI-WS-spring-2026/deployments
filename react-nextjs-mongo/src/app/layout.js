import './globals.css';
import AuthNav from './AuthNav';

export const metadata = {
  title: 'Project Manager',
  description: 'ITWS 4500 Lab 6 - Authorization',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app">
          <header className="header">
            <nav className="nav">
              <a href="/" className="logo">Project Manager</a>
              <AuthNav />
            </nav>
          </header>
          <main className="main">
            {children}
          </main>
          <footer className="footer">
            <p>ITWS 4500 - Lab 6</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
