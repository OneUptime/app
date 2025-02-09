import NotFound, { ComponentProps } from "../../../UI/Components/404";
import "@testing-library/jest-dom/extend-expect";
import { fireEvent, render, screen } from "@testing-library/react";
import Route from "Common/Types/API/Route";
import URL from "Common/Types/API/URL";
import Email from "Common/Types/Email";
import * as React from "react";
import { describe, expect, jest } from "@jest/globals";

// Mock the Navigation module to avoid real navigation
jest.mock("../../../UI/Utils/Navigation", () => {
  return {
    navigate: jest.fn(),
  };
});

describe("NotFound Component", () => {
  const mockProps: ComponentProps = {
    homeRoute: new Route("/"), // Replace with your actual home route object
    supportEmail: new Email("support@example.com"), // Replace with your actual support email
  };

  beforeEach(() => {
    render(<NotFound {...mockProps} />);
  });

  test("should display the 404 message", () => {
    const notFoundText: HTMLElement = screen.getByText("404");
    expect(notFoundText).toBeInTheDocument();
  });

  test('should display the "Page not found" title', () => {
    const pageTitle: HTMLElement = screen.getByText("Page not found");
    expect(pageTitle).toBeInTheDocument();
  });

  test('should display the "Please check the URL" message', () => {
    const errorMessage: HTMLElement = screen.getByText(
      "Please check the URL in the address bar and try again.",
    );
    expect(errorMessage).toBeInTheDocument();
  });

  test('should display "Go Home" button', () => {
    const goHomeButton: HTMLElement = screen.getByText("Go Home");
    expect(goHomeButton).toBeInTheDocument();
  });

  test('should display "Contact Support" button', () => {
    const contactSupportButton: HTMLElement =
      screen.getByText("Contact Support");
    expect(contactSupportButton).toBeInTheDocument();
  });

  test('should navigate to the home route when "Go Home" button is clicked', () => {
    const goHomeButton: HTMLElement = screen.getByText("Go Home");
    fireEvent.click(goHomeButton);
    expect(
      require("../../../UI/Utils/Navigation").navigate,
    ).toHaveBeenCalledWith(mockProps.homeRoute);
  });

  test('should navigate to the support email when "Contact Support" button is clicked', () => {
    const contactSupportButton: HTMLElement =
      screen.getByText("Contact Support");
    fireEvent.click(contactSupportButton);
    expect(
      require("../../../UI/Utils/Navigation").navigate,
    ).toHaveBeenCalledWith(
      URL.fromString("mailto:" + mockProps.supportEmail.toString()),
    );
  });
});
