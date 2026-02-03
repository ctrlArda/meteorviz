import matplotlib.pyplot as plt
import matplotlib.patches as patches

def create_architecture_diagram():
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 10)
    ax.axis('off')

    # Helper function to draw box with text
    def draw_box(x, y, width, height, text, color='#e0e0e0', edge_color='black'):
        rect = patches.FancyBboxPatch((x, y), width, height, boxstyle="round,pad=0.1", 
                                      linewidth=2, edgecolor=edge_color, facecolor=color)
        ax.add_patch(rect)
        ax.text(x + width/2, y + height/2, text, ha='center', va='center', fontsize=10, fontweight='bold', wrap=True)
        return (x + width/2, y, x + width/2, y + height) # return bottom-center and top-center

    # Helper for arrows
    def draw_arrow(x1, y1, x2, y2, text=""):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="->", lw=2, color='black'))
        if text:
            mid_x = (x1 + x2) / 2
            mid_y = (x1 + y1) / 2
            ax.text(mid_x, mid_y, text, ha='center', va='bottom', fontsize=9, color='#333', backgroundcolor='white')

    # --- Nodes ---

    # Data Source Group
    ax.text(2, 9.5, "Veri Kaynağı", fontsize=12, fontweight='bold', color='#555')
    nasa_pos = draw_box(0.5, 8, 3, 1, "NASA NeoWs API\n(Gerçek Veri)", color='#a8dadc')
    user_pos = draw_box(4, 8, 3, 1, "Kullanıcı Girdileri\n(Senaryo)", color='#a8dadc')

    # Development Phase Group
    ax.text(9.5, 9.5, "Geliştirme Aşaması", fontsize=12, fontweight='bold', color='#555')
    physics_pos = draw_box(8, 8, 3, 1, "Fizik Simülasyonları\n(create_dataset...)", color='#ffb7b2')
    dataset_pos = draw_box(8, 6, 3, 1, "Eğitim Veriseti\n(CSV)", color='#ffdac1')
    train_pos = draw_box(8, 4, 3, 1, "Makine Öğrenimi\nEğitimi (train_model.py)", color='#ffb7b2')

    # Runtime Phase Group
    ax.text(6, 3.5, "Çalışma Zamanı", fontsize=12, fontweight='bold', color='#555')
    model_pos = draw_box(2.5, 2, 3, 1, "Eğitilmiş AI Modeli\n(Hızlı Tahmin)", color='#457b9d', edge_color='#1d3557')
    # Make model box text white for contrast
    ax.text(2.5 + 1.5, 2 + 0.5, "Eğitilmiş AI Modeli\n(Hızlı Tahmin)", ha='center', va='center', fontsize=10, fontweight='bold', color='white')
    
    gis_pos = draw_box(2.5, 0, 3, 1, "GIS & Web Arayüzü\n(Leaflet.js)", color='#a8dadc')

    # --- Connections ---

    # Physics -> Dataset
    draw_arrow(physics_pos[0], physics_pos[1], dataset_pos[2], dataset_pos[3], "Simüle Veri")
    
    # Dataset -> Training
    draw_arrow(dataset_pos[0], dataset_pos[1], train_pos[2], train_pos[3], "Eğitim")

    # Training -> Model (dashed to imply export)
    ax.annotate("", xy=(model_pos[2]+1.5, model_pos[3]), xytext=(train_pos[0], train_pos[1]),
                arrowprops=dict(arrowstyle="->", lw=2, color='black', linestyle='dashed'))
    ax.text(6.5, 3, "Modeli Dışa Aktar", ha='center', va='center', fontsize=9, backgroundcolor='white')

    # NASA -> Model
    draw_arrow(nasa_pos[0], nasa_pos[1], model_pos[2]-0.5, model_pos[3], "Canlı Veri")

    # User -> Model
    draw_arrow(user_pos[0], user_pos[1], model_pos[2]+0.5, model_pos[3], "Parametreler")

    # Model -> GIS
    draw_arrow(model_pos[0], model_pos[1], gis_pos[2], gis_pos[3], "Sonuçlar")

    plt.title("MeteorViz Sistem Mimarisi", fontsize=16, fontweight='bold', pad=20)
    plt.tight_layout()
    
    output_path = 'results/architecture_diagram.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"Diagram saved to {output_path}")

if __name__ == "__main__":
    create_architecture_diagram()
