function CompanyFooter({ settings }) {
  return (
    <footer className="app-footer">
      <div className="app-footer-content">
        <div>
          <strong>{settings.business_name || "Juice Bar"}</strong>
          <p>{settings.address || "Address not set"}</p>
        </div>

        <div>
          <p>
            <strong>Contact:</strong> {settings.contact_number || "Not set"}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default CompanyFooter;
