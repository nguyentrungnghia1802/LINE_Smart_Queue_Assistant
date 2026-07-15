module.exports.shorthands = undefined;

module.exports.up = async (pgm) => {
  pgm.sql("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';");
};

module.exports.down = async () => {
  // PostgreSQL does not safely remove enum values in-place.
};
