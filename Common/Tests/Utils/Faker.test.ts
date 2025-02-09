import Email from "../../Types/Email";
import Name from "../../Types/Name";
import Phone from "../../Types/Phone";
import Faker from "../../Utils/Faker";
import { describe, expect, it } from "@jest/globals";

describe("Faker Class", () => {
  it("should generate a random name with alphanumeric characters", () => {
    expect(Faker.generateName()).toMatch(/^[a-zA-Z0-9]{10}$/);
  });

  it("should generate a random company name", () => {
    expect(Faker.generateCompanyName()).toBeTruthy();
  });

  it("should generate a string of random numbers of specified length", () => {
    expect(Faker.getRandomNumbers(8).toString()).toMatch(/^\d{8}$/);
  });

  it("should generate a user full name", () => {
    const userFullName: Name = Faker.generateUserFullName();
    expect(userFullName).toHaveProperty("name");
    expect(userFullName.name).toBeTruthy();
  });

  it("should generate a valid email address", () => {
    const email: Email = Faker.generateEmail();
    expect(email.email).toMatch(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,9}$/i);
  });

  it("should generate a valid phone number", () => {
    const phone: Phone = Faker.generatePhone();
    expect(phone.phone).toMatch(
      /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,7}$/,
    );
  });
});
