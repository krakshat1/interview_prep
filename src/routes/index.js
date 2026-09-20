// One place that lists every API router, so app.js just mounts them.
module.exports = {
  auth: require('./auth'),
  questions: require('./questions'),
  interview: require('./interview'),
  reports: require('./reports'),
  profile: require('./profile'),
  roadmap: require('./roadmap'),
  dashboard: require('./dashboard'),
  practice: require('./practice'),
  resume: require('./resume'),
  jobmatch: require('./jobmatch'),
  applications: require('./applications'),
  systemdesign: require('./systemdesign'),
  resumebuilder: require('./resumebuilder'),
};
