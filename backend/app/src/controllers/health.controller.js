export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'app-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
};
