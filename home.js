import React from 'react';

const Home = () => {
  return (
    <div className="home-container">
      {/* Section 1: Hero */}
      <section id="home">
        <h1>Welcome to JoyTech Solutions</h1>
        <p>Web & Software Development, Graphic Design, Networking, KRA, eCitizen, and Computer Solutions.</p>
      </section>

      {/* Section 2: Services */}
      <section id="services">
        <h2>What We Can Do For You</h2>
        <div className="services-grid">
          <div className="service-card">KRA Tax Returns</div>
          <div className="service-card">eCitizen Applications</div>
          <div className="service-card">Computer & ICT Help</div>
          <div className="service-card">Software Development</div>
          <div className="service-card">Website Development</div>
          <div className="service-card">Graphic Design</div>
        </div>
      </section>

      {/* Section 3: Projects */}
      <section id="projects">
        <h2>Projects Done</h2>
        <p>Detailed list of previous work goes here...</p>
      </section>
    </div>
  );
};

export default Home;
