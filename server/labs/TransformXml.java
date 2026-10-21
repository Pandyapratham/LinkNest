import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.xml.XMLConstants;
import javax.xml.transform.Source;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.stream.StreamSource;

/** Safely applies the project's trusted XSLT to one local XML input file. */
public class TransformXml {
  public static void main(String[] args) throws Exception {
    if (args.length != 2) {
      System.err.println("Usage: java server/labs/TransformXml.java <input.xml> <output.html>");
      System.exit(2);
    }
    Path input = Path.of(args[0]).toAbsolutePath().normalize();
    Path output = Path.of(args[1]).toAbsolutePath().normalize();
    Path stylesheet = Path.of("server", "labs", "linknest.xsl").toAbsolutePath().normalize();
    String xml = Files.readString(input);
    if (xml.matches("(?is).*<!\\s*(DOCTYPE|ENTITY)\\b.*")) {
      throw new IllegalArgumentException("DTD and entity declarations are not accepted.");
    }

    TransformerFactory factory = TransformerFactory.newInstance();
    factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
    factory.setURIResolver((href, base) -> { throw new TransformerException("External XSLT resources are disabled."); });
    Source trustedStylesheet = new StreamSource(Files.newInputStream(stylesheet));
    var transformer = factory.newTransformer(trustedStylesheet);
    transformer.transform(new StreamSource(new StringReader(xml)), new StreamResult(Files.newOutputStream(output)));
    System.out.println("Transformed " + input.getFileName() + " to " + output.getFileName());
  }
}
