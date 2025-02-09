import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1725976810107 implements MigrationInterface {
  public name = "MigrationName1725976810107";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ScheduledMaintenanceTemplate" ADD "sendSubscriberNotificationsOnBeforeTheEvent" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ScheduledMaintenanceTemplate" DROP COLUMN "sendSubscriberNotificationsOnBeforeTheEvent"`,
    );
  }
}
