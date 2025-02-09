import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1738844215519 implements MigrationInterface {
  public name = "MigrationName1738844215519";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ServiceProviderNotificationRule" ADD "name" character varying(500) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ServiceProviderNotificationRule" ADD "description" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "OnCallDutyPolicyScheduleLayer" ALTER COLUMN "rotation" SET DEFAULT '{"_type":"Recurring","value":{"intervalType":"Day","intervalCount":{"_type":"PositiveNumber","value":1}}}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "OnCallDutyPolicyScheduleLayer" ALTER COLUMN "restrictionTimes" SET DEFAULT '{"_type":"RestrictionTimes","value":{"restictionType":"None","dayRestrictionTimes":null,"weeklyRestrictionTimes":[]}}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "OnCallDutyPolicyScheduleLayer" ALTER COLUMN "restrictionTimes" SET DEFAULT '{"_type": "RestrictionTimes", "value": {"restictionType": "None", "dayRestrictionTimes": null, "weeklyRestrictionTimes": []}}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "OnCallDutyPolicyScheduleLayer" ALTER COLUMN "rotation" SET DEFAULT '{"_type": "Recurring", "value": {"intervalType": "Day", "intervalCount": {"_type": "PositiveNumber", "value": 1}}}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ServiceProviderNotificationRule" DROP COLUMN "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ServiceProviderNotificationRule" DROP COLUMN "name"`,
    );
  }
}
