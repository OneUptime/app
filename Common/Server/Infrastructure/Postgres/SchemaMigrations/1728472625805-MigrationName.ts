import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1728472625805 implements MigrationInterface {
  public name = "MigrationName1728472625805";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "StatusPageDomain" ADD "customCertificate" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "StatusPageDomain" ADD "customCertificateKey" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "StatusPageDomain" ADD "isCustomCertificate" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "StatusPageDomain" DROP COLUMN "isCustomCertificate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "StatusPageDomain" DROP COLUMN "customCertificateKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "StatusPageDomain" DROP COLUMN "customCertificate"`,
    );
  }
}
