exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE assistant_pending_actions
      DROP CONSTRAINT IF EXISTS assistant_pending_actions_action_type_check;
    ALTER TABLE assistant_pending_actions
      ADD CONSTRAINT assistant_pending_actions_action_type_check
      CHECK (action_type IN ('delete_agent', 'forget_everything', 'confirm_memory', 'select_agent', 'confirm_intent'));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DELETE FROM assistant_pending_actions WHERE action_type = 'confirm_intent';
    ALTER TABLE assistant_pending_actions
      DROP CONSTRAINT IF EXISTS assistant_pending_actions_action_type_check;
    ALTER TABLE assistant_pending_actions
      ADD CONSTRAINT assistant_pending_actions_action_type_check
      CHECK (action_type IN ('delete_agent', 'forget_everything', 'confirm_memory', 'select_agent'));
  `);
};
